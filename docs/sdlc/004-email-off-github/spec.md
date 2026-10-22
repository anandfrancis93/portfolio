# Spec: keep my email address off GitHub

Status: draft, for the product owner's review.
Derived from: `intent.md` (accepted 22 October 2026, PR #112).
Constraints applied: the `web-quality` skill's rules on deploy configuration apply to the
`deploy` and `ci` workflow changes; the `acme-design-system` skill constrains nothing, since no
page or style changes; the `portfolio-voice` skill changes in one line (section 5).
Companion documents: spec 001 sections 3.8 and 8, which this change amends in part, spec 003,
whose watch the swap must not trip, and `docs/runbook.md`.

This spec names the address only as "the address". It never spells it.

## 1. What this change delivers

- The site shows the address in the same four places as today: Contact, the mobile menu, the
  404 page and the résumé PDF.
- After the build lands, no file in the repository spells the address.
- `ci` builds and tests with a stand-in address, so its artifacts and logs hold only the
  stand-in.
- Only the `deploy` workflow's preview and production builds hold the address, from a secret.
- After the swap, no commit in the public repository carries the address as author, as
  committer, or in any file.

## 2. Where the address comes from

### 2.1 The value

- One environment variable, `CONTACT_EMAIL`, holds the address at build time.
- The stand-in is `contact@example.com`. RFC 2606 reserves `example.com`, so the stand-in
  reaches nobody.
- With `CONTACT_EMAIL` unset or empty, the build uses the stand-in. A build never fails for want
  of the value, so `pnpm verify`, `ci` and a Dependabot pull request need no secret.
- This departs from the intent's outcome 1, "A build without the value fails". The guard moves
  from the build to the deploy (3.3), so a release still never ships the stand-in. Concern 1 in
  section 9 puts this to the owner.

### 2.2 The profile

- `src/content/profile.yaml` drops `identity.email`. Every other piece of copy stays there.
- `loadProfile` takes the address as a second argument and puts it at `identity.email`, so every
  reader of `profile.identity.email` keeps working unchanged. The schema still validates it as
  an email.
- One small module resolves the address from `process.env.CONTACT_EMAIL`, with the stand-in as
  fallback. Every caller of `loadProfile` gets the address from it: `site.ts`,
  `tests/helpers/page.ts`, `tests/pdf.spec.ts`, `tests/e2e/content.spec.ts`,
  `tests/e2e/disclosure.spec.ts` and `scripts/check-content.mjs`. A config test proves the build
  and the tests resolve the same value.
- Astro's `.env` loading is not used for the address. The build, the tests and the scripts read
  only the process environment, so they can never disagree.

### 2.3 Local builds

- A local build with no variable shows the stand-in. That is correct for every check.
- A local deploy (`pnpm run deploy:preview`) needs `CONTACT_EMAIL` exported in the shell for its
  build. A `.env` file does not supply it (2.2). The runbook says so in one line.

## 3. The workflows

### 3.1 `ci`

- `ci` never receives `CONTACT_EMAIL`. Its build, tests, Lighthouse run and `reports` artifact
  all hold the stand-in.
- No other change to `ci`.

### 3.2 `deploy`

- The `preview` and `production` jobs pass `CONTACT_EMAIL` from a repository secret of that
  name to their `pnpm build` step, and to no other step.
- The `production` job reads it through its `production` environment, which sees repository
  secrets unless it holds a secret of the same name. It does not, and none is added.
- No job in `deploy` uploads an artifact today, and none starts to.
- No step is added or renamed, so spec 003's step windows stay as they are.

### 3.3 The refusal

- `scripts/deploy.mjs` refuses to deploy when any HTML file in `dist/` contains the stand-in.
  The message names the variable, never a value. The PDF comes from the same build, and its text
  streams are compressed, so the HTML is the check.
- This covers both workflow jobs and a local deploy. A deploy can never publish the stand-in.

## 4. Checks and tests

- `scripts/check-voice.mjs` drops its fact that compares `identity.email` with the spelled
  address. The schema already checks the shape.
- The content, mobile menu, keyboard and PDF tests keep comparing against
  `profile.identity.email`. In `ci` and locally that is the stand-in.
- A new fast check fails when any tracked file contains an address at the Gmail domain. It needs no secret and
  holds no copy of the address, so it runs in `pnpm check` and on every pull request. It stops a
  later commit from spelling the address again. The check builds its pattern from parts, so it
  does not match itself.
- A config test proves the refusal in 3.3 against a temporary `dist/` holding the stand-in.

## 5. Documents

- The voice skill's line "Email shown in full" names `CONTACT_EMAIL` and this spec, not the
  address.
- Intent 001 and spec 001 section 3.8 say "my public Gmail address" in place of the spelled
  address. Spec 001 section 8 and CLAUDE.md's convention "Copy lives only in
  `src/content/profile.yaml`" each gain the exception: the address comes from `CONTACT_EMAIL`.
- CLAUDE.md lists intent 004 beside the others.
- The runbook gains a short section, "The contact address": where it lives, how to change it,
  and the local deploy line from 2.3.
- Plan 004 records each of these edits to accepted documents.

## 6. The history rewrite and the swap

### 6.1 Order

1. The owner adds the secret `CONTACT_EMAIL` before the build pull request opens, since its
   preview deploy needs it (3.3). Claude never sees its value.
2. The build of sections 2 to 5 merges, and a release through `deploy` shows the address on the
   live site.
3. The rewrite and the swap follow, in one sitting, as below.

### 6.2 The rewrite

- From a fresh clone of `main`, `git filter-repo` with a mailmap and a replace-text file, both
  kept outside the repository:
  - the mailmap maps the address to `23470013+anandfrancis93@users.noreply.github.com`, for
    author and committer;
  - the replace-text file maps the address to the stand-in in every file of every commit, and
    `--replace-message` applies it to commit messages too.
- Proof before any push: no commit's author, committer, message or file holds the address, and
  the rewritten `main`'s tree equals the old `main`'s tree. The second holds because section 2's
  build already removed the address from the current files.
- Only `main` moves. The repository has no tags; other branches stay in the archive.

### 6.3 The swap

- Quiet first: no merge and no deploy for 75 minutes before the swap. Spec 003's first run in a
  new repository reads back 75 minutes and has no deploy runs to match, so an earlier deploy
  would be reported.
- The owner, or Claude on the owner's MacBook with his approval in the thread:
  1. saves the repository's settings, labels, ruleset, environment and secret names to a file;
  2. renames `portfolio` to `portfolio-archive`, makes it private, and disables its Actions, so
     its hourly watch stops and cannot report the new repository's deploys;
  3. creates a new public `portfolio` and pushes the rewritten `main`;
  4. sets the merge options, labels, Actions permissions, the ruleset requiring `ci`, the
     `production` environment with its reviewer rule, code scanning, secret scanning, push
     protection and Dependabot security updates, as saved;
  5. adds the five repository secrets, `CLOUDFLARE_API_TOKEN` (the preview token),
     `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_WATCH_TOKEN`, `CLAUDE_CODE_OAUTH_TOKEN` and
     `CONTACT_EMAIL`, and the `production` environment's own secrets, as saved, among them its
     `CLOUDFLARE_API_TOKEN` (the production token). Only the owner handles values;
  6. checks that the Claude GitHub app can reach the new repository.
- Then: dispatch `watch` once and see it green, so the heartbeat has a run; open one small pull
  request and see `ci`, `review` and the preview deploy green.
- The Cloudflare side does not change. The Workers, routes and tokens stay as they are.

### 6.4 After the swap

- Links in the docs to old pull requests and issues now point to numbers the new repository
  will reuse. Plan 004's closing record says so and names `portfolio-archive` as their home.
- The first merge in the new repository is checked: its author and committer carry no address.
- The owner sets his MacBook's `git config --global user.email` to the noreply address, confirms
  "Keep my email addresses private" is on, and turns on "Block command line pushes that expose my
  email".

## 7. Quality gates

1. `pnpm verify` green locally and in `ci` with no `CONTACT_EMAIL` set.
2. The Gmail-domain check in section 4 green, and a search of the tracked files for the address,
   run once by the owner with the value, empty.
3. The preview deploy of the build pull request shows the address in the four places, checked
   by the owner on the preview URL.
4. The refusal in 3.3 proven by its test.
5. The rewrite's proof in 6.2, its output pasted into plan 004.
6. After the swap: the new repository's `ci` and `watch` green, and a search of its history and
   files for the address empty.

## 8. Technical decisions for the plan stage

- How a build reads `CONTACT_EMAIL`: Astro's `astro:env`, Vite's `import.meta.env`, or
  `process.env` in `site.ts`. The plan picks one and proves it with a config test.
- Where the no-address test of section 4 runs with the value: a local run by the owner before
  the swap, or a step in `deploy`.
- The order of work across pull requests, and which ones the owner merges before the swap.

## 9. Areas of concern for the product owner

1. **A build without the value uses the stand-in, not a failure.** This departs from intent
   outcome 1 (2.1). The deploy refuses the stand-in instead, which keeps `ci` and Dependabot
   pull requests free of the secret. Recommended: accept, and record the departure in plan 004.
2. **`ci` tests the stand-in, not the address.** A typo in the secret would reach the preview
   first. Recommended: accept; the preview check in gate 3 catches it before a release.
3. **The swap is one sitting with a quiet hour.** Recommended: accept; it happens once.
4. **Old links in the docs change meaning.** Pull request numbers restart in the new repository.
   Recommended: accept, with the record in 6.4.
5. **Copies outside GitHub stay.** Clones, forks and scrapers that read the history before the
   swap keep the address. Recommended: accept, as the intent's out-of-scope list says.

## 10. Traceability

- Intent outcome 1 (the address from outside the repository): sections 2 and 3.2, with the
  departure in 2.1 and concern 1.
- Outcome 2 (checks and tests stop naming it): section 4, gate 2.
- Outcome 3 (CI output does not leak it): sections 3.1 and 3.2.
- Outcome 4 (history no longer contains it): sections 6.2 and 6.3, gates 5 and 6.
- Outcome 5 (new commits do not bring it back): section 6.4.
- The intent's open questions: Dependabot pull requests in 2.1 and 3.1; the artifacts in 3.1.
- The intent's constraints: the owner handles the address and secrets, in 6.1 and 6.3; the
  repository stays public, in 6.3; the rewrite after the build, in 6.1; intent 003's watch, in
  3.2 and 6.3.
