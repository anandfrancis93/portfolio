# Plan: keep my email address off GitHub (from spec.md, 22 October 2026)

Status: accepted by the engineer and product owner on 22 October 2026, before any code was written.
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
- Three components and one page read `identity.email`: `Contact.astro`, `MobileMenu.astro`,
  `print/Resume.astro` and `src/pages/404.astro`. The schema validates it with `z.email()` inside a
  strict object (`src/content/schema.ts` line 50).
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
- The live `main` ruleset has no bypass actors, a pull request rule, and the required `ci`
  check enforced on creation, so it refuses a push that creates `main`. Plan 001 pushed `main`
  first and added the ruleset after.
- Vite 8.2.4 keeps `process.env` unreplaced in server environments, and Astro 7.2.10 does not
  override that, so the prerender reads the real environment. But during `astro build`, Astro's
  env plugin loads every key of the `.env*` files (Vite's `loadEnv` with an empty prefix) into
  `process.env` (`astro/dist/env/vite-plugin-env.js`). So a local `.env` reaches `site.ts` and
  not the Node scripts or Playwright.
- `git filter-repo` (the container's build, `a40bce548d2c`) runs `--email-callback` on author,
  committer and tagger addresses, and exposes `os` and `re` to every callback. A dry run of B step 4
  on a scratch repository, with a made-up address in mixed case, left no address in any author,
  committer, message or file, and the head tree unchanged. A run of the case-sensitive form of B
  step 4 on a clone of the real history, with the real value, left all three counts at 0, also
  case-insensitively, against 321 identity matches before it. That run dropped the signatures of 51
  signed commits, as any rewrite does, and turned the clone's `origin/*` branches into local
  branches.

## Decisions taken in this plan (the spec is not reopened)

1. **How a build reads `CONTACT_EMAIL` (spec 8, first point).** `process.env`, through one new
   module, `src/content/contact.ts`. It exports `STAND_IN` (`contact@example.com`) and
   `contactEmail(env = process.env)`, which returns the trimmed `CONTACT_EMAIL` or, when that is
   unset or empty, the stand-in. Astro's prerender runs in Node, so `site.ts` reads the same
   environment as the scripts and the tests. Not `astro:env` or `import.meta.env`: neither
   works in the Node scripts. Astro copies `.env*` keys into `process.env` during a build
   (Context), so spec 2.2's "can never disagree" holds only while no `.env*` file defines
   `CONTACT_EMAIL`. `scripts/check-address.mjs` enforces that (decision 4).
   A config test, `tests/config/contact-build.test.mjs`, proves the choice: it runs
   `astro build --outDir` into a temporary folder with `CONTACT_EMAIL` set to a test address at
   `example.org`, and checks that `index.html` and `404.html` hold it and not the stand-in. It
   runs inside `pnpm test:config`, so it adds one Astro build (about half a minute) to
   `pnpm check`.
2. **`loadProfile(source, email)`.** The second argument is required. `loadProfile` refuses a
   source that still holds `identity.email`, with a message that names `CONTACT_EMAIL`, then
   sets the field and validates as today. All eleven callers pass `contactEmail()`.
3. **The refusal (spec 3.3)** lives in `scripts/lib/stand-in.mjs` as `findStandIn(distDir)`,
   which returns the HTML files under `dist/` that contain `STAND_IN`. `scripts/deploy.mjs`
   calls it after its existing checks, before wrangler, and exits 1 with one line naming
   `CONTACT_EMAIL` and the first file. A build that did not see the secret writes the stand-in,
   so the refusal also proves, on each deploy, that the workflow's secret reached the build.
4. **The Gmail-domain check (spec 4)** is `scripts/check-address.mjs` over
   `scripts/lib/address.mjs`. It lists the tracked files with `git ls-files -z`, reads each as
   text, and fails on an address at the Gmail domain. Its pattern is built from parts, so its own
   source does not match. A finding prints the file and the line number, never the line, so a
   `ci` log never repeats the address. It also fails when a `.env` or `.env.*` file at the
   repository root defines `CONTACT_EMAIL`, naming the file and never the value, so a local
   build and the local tests cannot read different addresses (decision 1). It runs in
   `pnpm check` after `check-voice.mjs`.
5. **Where the search with the value runs (spec 8, second point).** On the owner's MacBook, inside
   phase B, as part of the rewrite's proof (B step 5). That proof searches every file of every
   commit, the head included, so it is gate 2's second half too. No workflow step gets the value for
   a search.
6. **The order of work (spec 8, third point).** Three phases, below. The owner merges phase A
   and releases it before phase B.
7. **The rewrite reads the address from the owner's shell, not from a file.** The owner types
   it once into a hidden prompt (`read -rs CONTACT_EMAIL`) in his own terminal, since an agent's
   shell has no terminal for the prompt. Three filter-repo callbacks read
   `os.environ["CONTACT_EMAIL"]` and match it in any case: the email callback maps it to the
   noreply address, the blob callback and the message callback replace it with the stand-in. A
   positive control before the rewrite proves the typed value is the address. So no mailmap or
   replace-text file holds the address, and no command Claude writes or reads does either. This
   departs from spec 6.2's "a mailmap and a replace-text file"; spec 6.2 is corrected in place
   in phase A's PR, marked with this date.
8. **Secrets before the push, the ruleset after.** Spec 6.3 pushes the rewritten `main`
   (step 3) before the settings and secrets (steps 4 and 5). This plan creates the empty
   repository, applies the settings, the environment and the secrets, pushes `main`, and only
   then adds the ruleset and code scanning. Pushed before its secrets, the hourly watch could
   run with no token and open "The watch failed". The ruleset goes last because it refuses the
   push that creates `main` (Context), and code scanning's default setup needs code to scan.
   Spec 6.3 is corrected in place in phase A's PR, marked with this date.
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
tests/config/contact.test.mjs  tests/config/contact-build.test.mjs  tests/config/address.test.mjs
.github/workflows/deploy.yml (changed)  package.json (changed)
.claude/skills/portfolio-voice/SKILL.md (changed)  CLAUDE.md (changed)  docs/runbook.md (changed)
docs/sdlc/001-portfolio-v1/intent.md  docs/sdlc/001-portfolio-v1/spec.md (each changed)
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
    caller of `loadProfile` passing `contactEmail()`, the callers found by a search of the
    tracked files, not a fixed list, so a new caller is covered; `findStandIn`
    against a temporary `dist/` with and without the stand-in; `deploy.mjs` exiting 1 on a
    temporary build with the stand-in, before wrangler runs; and `deploy.yml` giving
    `CONTACT_EMAIL` to exactly the two `pnpm build` steps, read through the `yaml` package.
  - `tests/config/address.test.mjs`: the pattern matches an address at the Gmail domain in any
    case, and not the stand-in or other domains; a finding names the file and line and not the
    text; a `.env` file that defines `CONTACT_EMAIL` fails and one that does not passes;
    `check-address.mjs`'s own source passes. The test's sample addresses are built from parts
    too, so the test file passes the check.
  - `tests/config/contact-build.test.mjs`: the build test of decision 1.
  - Documents (spec 5): the voice skill's line; intent 001 line 33 and spec 001 section 3.8 say
    "my public Gmail address"; spec 001 section 8 and CLAUDE.md's copy convention gain the
    exception; CLAUDE.md's Process line lists `004-email-off-github`, in progress; the runbook
    gains "The contact address"; this file's "Records" lists each edit to an accepted document;
    spec 004 sections 2.2, 6.2 and 6.3 corrected in place for the eleven callers and decisions 7
    and 8, each marked with the date.
- Done: `pnpm verify` green at the head with no `CONTACT_EMAIL` set; the PR's preview deploy green,
  which proves the workflow's secret reached the build (decision 3); the owner checks the four
  places on the preview URL (gate 3); the owner runs `pnpm eval:skills` once (decision 9).
- Then: the owner merges, and releases through `deploy`'s `release` dispatch. The live site
  shows the address in the four places.
- Could go wrong: the build test reading the stand-in, if a later Astro or Vite release
  replaces `process.env` in the prerender (Context says this one does not). The fallback is
  Astro's `astro:env` with a server secret, recorded here as a departure. A Dependabot pull
  request has no secret, so its preview job skips, as today. The `review` workflow, or a
  pre-flight report, quoting a removed line of the diff in a public comment: the reviewer's
  prompt for this PR says to name the address only as "the address", and each report is read
  for it before it is posted; a comment that slips stays only until the archive turns private
  in phase B.

### B. The rewrite and the swap (no pull request)

On the owner's MacBook, in one sitting. The owner runs steps 3 to 5 in his own terminal, one
shell from start to end, since the value lives only in that shell. Claude drives the other
steps through Remote Control, with his approval in the thread, and reads only the counts and
tree ids the owner pastes.

1. Quiet: no merge and no deploy for 75 minutes before step 8 (spec 6.3).
2. Save the repository's settings, labels, ruleset, environment, environment secret names and
   repository secret names to a file outside the repository.
3. A fresh clone of `main`, outside any other checkout, the old tree id, and the value:

   ```
   git clone https://github.com/anandfrancis93/portfolio.git portfolio-rewrite && cd portfolio-rewrite
   git rev-parse 'origin/main^{tree}'
   read -rs CONTACT_EMAIL && export CONTACT_EMAIL && [ -n "$CONTACT_EMAIL" ] || echo "empty: stop"
   ```

4. The positive control and the rewrite. The control runs the counts of step 5 before the
   rewrite; its identity count must not be 0 (it was 321 on 22 October), or the value is
   mistyped and the sitting stops. Then:

   ```
   git filter-repo --force \
     --email-callback 'return b"23470013+anandfrancis93@users.noreply.github.com" if email.lower() == os.environ["CONTACT_EMAIL"].lower().encode() else email' \
     --blob-callback 'blob.data = re.sub(re.escape(os.environ["CONTACT_EMAIL"].encode()), b"contact@example.com", blob.data, flags=re.I)' \
     --message-callback 'return re.sub(re.escape(os.environ["CONTACT_EMAIL"].encode()), b"contact@example.com", message, flags=re.I)'
   ```

5. The proof, which prints counts and a tree id only:

   ```
   git log --all --format='%ae%n%ce' | grep -c -i -F -e "$CONTACT_EMAIL"
   git log --all --format='%B' | grep -c -i -F -e "$CONTACT_EMAIL"
   git rev-list --all | while read -r c; do git grep -l -i -F -e "$CONTACT_EMAIL" "$c"; done | wc -l
   git rev-parse 'main^{tree}'
   ```

   The three counts are 0, and the tree id equals step 3's. If not, the sitting stops before
   step 6.
6. Rename `portfolio` to `portfolio-archive`, make it private, and disable its Actions.
7. Create an empty public `portfolio`. Apply the saved merge options, labels, Actions
   permissions, the `production` environment with its reviewer rule, secret scanning, push
   protection and Dependabot security updates. The owner adds the five repository secrets and
   the `production` environment's secrets (spec 6.3 step 5).
8. Push `main` only: `git remote add origin <the new repository> && git push origin main`. The
   clone's other branches stay local and are deleted with it. Then add the ruleset requiring
   `ci` and code scanning's default setup (decision 8).
9. Check that the Claude GitHub app reaches the new repository, dispatch `watch` once and see it
   green, then open phase C's pull request and see `ci`, `review` and the preview deploy green.
   Repeat step 5's counts on a fresh clone of the new repository, in the same shell.
10. The owner sets his MacBook's `git config --global user.email` to the noreply address,
    confirms "Keep my email addresses private" is on, and turns on "Block command line pushes
    that expose my email" (spec 6.4).

- Could go wrong: the owner no longer holds a token's value, since Cloudflare shows a token once.
  He then rolls that token in Cloudflare, and if its expiry changes, phase C updates
  `.github/expiry.json`. A count in step 5 not 0: the sitting stops, and the callbacks are fixed
  and rerun on a fresh clone. The MacBook's `git filter-repo` or git differing from the
  container's: the positive control and step 5's counts catch a rewrite that missed anything.

### C. The records and the close (in the new repository)

- Files: this file's "Records" (the output of B steps 3 to 5, the watch run, phase C's own
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
| 2 the Gmail-domain check green; the search with the value empty | `address.test.mjs`; B step 5 | `pnpm check`; record | A, B |
| 3 the preview shows the address in the four places | the owner, on the preview URL | record | A |
| 4 the refusal proven; the build reads the variable | `contact.test.mjs`, `contact-build.test.mjs` | `pnpm test:config` | A |
| 5 the rewrite's proof | B steps 4 and 5: the control, the counts, the tree ids | record | B, C |
| 6 the new repository's `ci` and `watch` green; its history and files hold no address | B step 9 | record | B, C |

## Records

- Phase A, 22 October 2026: the edits to accepted documents (spec 5). Intent 001 line 33 and
  spec 001 section 3.8 say "my public Gmail address" in place of the address; spec 001
  section 8 and CLAUDE.md's copy convention name the `CONTACT_EMAIL` exception; CLAUDE.md's
  Process line lists intent 004 and its Config tests line names the contact address; the voice
  skill's "Email shown in full" line names `CONTACT_EMAIL`; the runbook gains "The contact
  address"; spec 004 sections 2.2, 6.2 and 6.3 are corrected in place, each marked with this
  date (the eleven callers and the `.env` guard; decision 7; decision 8).

- Phase B, 22 and 23 October 2026: the rewrite and the swap, on the owner's MacBook.
  - Step 1: no merge and no deploy after the release at 20:36 UTC on 22 October; the swap's
    push came at 04:23 UTC on 23 October.
  - Step 2: the settings saved to a folder outside the repository; the address appears in none
    of the saved files.
  - Steps 3 to 5, on a fresh clone of 208 commits:

    ```
    old tree: 7430294ed6fd5e22400869ae054c7bd5f3df0a66
    distinct gmail-domain identities: 1
    control (before)  identity: 321  messages: 0  files: 995
    filter-repo exit: 0
    proof (after)     identity: 0    messages: 0  files: 0
    new tree: 7430294ed6fd5e22400869ae054c7bd5f3df0a66
    commits: 208
    gmail-domain anywhere in identities after: 0
    ```

  - Step 6: `portfolio` renamed `portfolio-archive`, made private, its Actions disabled. The
    pull requests and issues numbered in these documents before 23 October 2026, among them
    the 65 open watch issues #83 to #117, belong to `portfolio-archive`; this repository reuses
    the numbers.
  - Step 7: the new public `portfolio` (id 1430560753) created empty; the merge options,
    labels, Actions and workflow permissions, the `production` environment, secret scanning,
    push protection, Dependabot alerts and security updates compared equal to the saved
    settings. The five repository secrets and the `production` secret added by the owner.
  - Step 8: `main` pushed alone, its tree 7430294 on GitHub; the `main` ruleset (requiring
    `ci`) recreated equal to the saved one; code scanning's default setup configured.
  - Step 9: the Claude GitHub app reads and writes the new repository. On the pushed `main`,
    `ci` passed, its `watch heartbeat` job red only until the first `watch` run existed, and
    green on its rerun; the preview deploy and CodeQL passed. `watch`, dispatched once, passed
    (run 39900231259). Code scanning's default setup first took GitHub Actions alone, before
    the languages were detected, and was set to Actions and JavaScript/TypeScript, as saved.
    The owner's recount on a fresh clone of the new repository, in the same three searches as
    step 5, printed 0, 0 and 0. A second recount on the MacBook, its value taken from the
    archive's one identity at the Gmail domain, matched 321 identities there (the control) and
    0, 0 and 0 in the new repository.
  - Step 10: OWNER_SETTINGS

## Departures recorded during implementation

- Phase A, 22 October 2026: the build test of decision 1 takes about six seconds here, not
  half a minute, since it runs `astro build` alone, without the PDF and card renders of
  `postbuild`. Its HTML check reads `index.html` and `404.html`; the résumé page is build-only
  and `finalize-dist.mjs` removes it, so the PDF test covers it.

- Phase B, 23 October 2026: the owner asked Claude to run steps 3 to 5. Claude's permission mode
  on the MacBook refused `git filter-repo`, so the owner ran a script Claude wrote. The script
  took the value from the history's one identity at the Gmail domain, into a shell variable,
  in place of the owner typing it; it stopped unless exactly one such identity existed, and the
  control's 321 matched the count of 22 October, so the value was the right one. It printed
  only counts and tree ids.
- Phase B, 23 October 2026: the same permission mode refused creating a public repository, so
  the owner ran step 7 from a second script Claude wrote, which compared each setting with the
  saved one; Claude ran step 8. GitHub refused `allow_forking` (HTTP 422), which a personal
  repository cannot change; it compared equal.
- Phase B, 23 October 2026: Cloudflare shows a token once, so the owner rolled the preview,
  production and watch tokens and issued a new `CLAUDE_CODE_OAUTH_TOKEN` with
  `claude setup-token`, as "Could go wrong" foresaw. EXPIRY_NOTE
